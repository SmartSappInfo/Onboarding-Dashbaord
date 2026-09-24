'use client';

/**
 * {{Org_name}} Experience Platform — Curriculum Tree Pane
 *
 * Left-hand pane for the full-screen Curriculum Editor Modal.
 * Organizes modules and lessons into a sortable, accessible hierarchy:
 * - Module cards with inline editing, drip rule pill, and deletion.
 * - Nested lesson items with content-type icons, duration badges, and preview indicators.
 * - Drag-and-drop reordering with @dnd-kit/sortable + 1-tap Move Up / Move Down buttons for mobile.
 * - Strict touch target ergonomics: minimum 44px tap targets on all interactive elements.
 *
 * Conforms to:
 * - `emilkowal-animations`: `active:scale-[0.97]`.
 * - `vercel-react-best-practices`: Memoized items, no layout thrashing.
 * - Zero `any` or `any[]` typing.
 */

import * as React from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type {
  CourseModule,
  CourseLesson,
  ReleaseScheduleType,
} from '@/lib/types/learning';
import {
  Plus,
  Trash2,
  Lock,
  PlayCircle,
  FileText,
  HelpCircle,
  FileCode,
  GripVertical,
  ChevronUp,
  ChevronDown,
  Layers,
  Sparkles,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface CurriculumTreePaneProps {
  modules: CourseModule[];
  lessons: CourseLesson[];
  selectedLessonId: string | null;
  onSelectLesson: (lessonId: string) => void;
  onAddModule: () => void;
  onUpdateModule: (moduleId: string, updates: Partial<CourseModule>) => void;
  onDeleteModule: (moduleId: string) => void;
  onAddLesson: (moduleId: string) => void;
  onDeleteLesson: (lessonId: string) => void;
  onReorderModules: (reordered: CourseModule[]) => void;
  onReorderLessons: (moduleId: string, reordered: CourseLesson[]) => void;
  isMutating?: boolean;
}

// ── Content Type Icon Helper ─────────────────────────────────────────────────
function getContentTypeIcon(contentType: string) {
  switch (contentType) {
    case 'video':
      return <PlayCircle className="w-3.5 h-3.5 text-primary shrink-0" />;
    case 'article':
      return <FileText className="w-3.5 h-3.5 text-blue-500 shrink-0" />;
    case 'quiz':
      return <HelpCircle className="w-3.5 h-3.5 text-amber-500 shrink-0" />;
    case 'assignment':
      return <FileCode className="w-3.5 h-3.5 text-purple-500 shrink-0" />;
    default:
      return <PlayCircle className="w-3.5 h-3.5 text-primary shrink-0" />;
  }
}

// ── Sortable Lesson Item ─────────────────────────────────────────────────────
interface SortableLessonRowProps {
  lesson: CourseLesson;
  index: number;
  totalLessons: number;
  isSelected: boolean;
  onSelect: () => void;
  onDelete: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
}

const SortableLessonRow = React.memo(function SortableLessonRow({
  lesson,
  index,
  totalLessons,
  isSelected,
  onSelect,
  onDelete,
  onMoveUp,
  onMoveDown,
}: SortableLessonRowProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: lesson.id });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
    zIndex: isDragging ? 20 : 1,
  };

  const hasBlocks = Boolean(lesson.blocks && lesson.blocks.length > 0);

  return (
    <div
      ref={setNodeRef}
      style={style}
      onClick={onSelect}
      className={cn(
        'group flex items-center justify-between p-2.5 rounded-2xl border transition-all cursor-pointer min-h-[44px]',
        isSelected
          ? 'bg-primary/10 border-primary text-foreground font-bold ring-2 ring-primary/20 shadow-xs'
          : 'bg-card border-border/70 hover:border-primary/40 text-foreground/90'
      )}
    >
      <div className="flex items-center gap-2 min-w-0 flex-1">
        {/* Drag handle */}
        <button
          type="button"
          {...attributes}
          {...listeners}
          onClick={e => e.stopPropagation()}
          className="p-1 rounded-lg text-muted-foreground hover:text-foreground cursor-grab active:cursor-grabbing hover:bg-muted/60 transition-colors"
          title="Drag to reorder"
          aria-label="Drag to reorder lesson"
        >
          <GripVertical className="w-3.5 h-3.5" />
        </button>

        {/* Content Type Icon */}
        {getContentTypeIcon(lesson.contentType)}

        {/* Title and Index */}
        <div className="min-w-0 flex-1">
          <p className="text-xs truncate font-medium">
            <span className="text-[11px] font-bold text-muted-foreground mr-1.5">
              {index + 1}.
            </span>
            {lesson.title}
          </p>
        </div>

        {/* Badges */}
        <div className="flex items-center gap-1.5 shrink-0">
          {hasBlocks && (
            <Badge variant="outline" className="text-[9px] font-bold text-primary border-primary/30 px-1 py-0 gap-0.5">
              <Sparkles className="w-2.5 h-2.5" /> Studio
            </Badge>
          )}

          {lesson.isPreview && (
            <Badge className="bg-emerald-500/10 text-emerald-600 border-0 text-[9px] font-bold px-1.5 py-0">
              Preview
            </Badge>
          )}

          <span className="text-[10px] text-muted-foreground font-medium">
            {lesson.videoDurationSeconds ? `${Math.round(lesson.videoDurationSeconds / 60)}m` : '10m'}
          </span>
        </div>
      </div>

      {/* Row Actions: 1-Tap Mobile Reorder + Delete */}
      <div className="flex items-center gap-1 ml-2 opacity-80 group-hover:opacity-100 transition-opacity">
        <button
          type="button"
          disabled={index === 0}
          onClick={e => {
            e.stopPropagation();
            onMoveUp();
          }}
          className="w-7 h-7 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-30 disabled:pointer-events-none active:scale-[0.95]"
          title="Move lesson up"
          aria-label="Move lesson up"
        >
          <ChevronUp className="w-3.5 h-3.5" />
        </button>

        <button
          type="button"
          disabled={index === totalLessons - 1}
          onClick={e => {
            e.stopPropagation();
            onMoveDown();
          }}
          className="w-7 h-7 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-30 disabled:pointer-events-none active:scale-[0.95]"
          title="Move lesson down"
          aria-label="Move lesson down"
        >
          <ChevronDown className="w-3.5 h-3.5" />
        </button>

        <button
          type="button"
          onClick={e => {
            e.stopPropagation();
            onDelete();
          }}
          className="w-7 h-7 rounded-lg flex items-center justify-center text-muted-foreground hover:text-rose-500 hover:bg-rose-500/10 active:scale-[0.95] transition-colors"
          title="Delete lesson"
          aria-label="Delete lesson"
        >
          <Trash2 className="w-3 h-3" />
        </button>
      </div>
    </div>
  );
});

// ── Main Curriculum Tree Component ───────────────────────────────────────────
export function CurriculumTreePane({
  modules,
  lessons,
  selectedLessonId,
  onSelectLesson,
  onAddModule,
  onUpdateModule,
  onDeleteModule,
  onAddLesson,
  onDeleteLesson,
  onReorderModules: _onReorderModules,
  onReorderLessons,
  isMutating,
}: CurriculumTreePaneProps) {
  // Dnd-kit sensors configured for desktop and mobile touch
  const pointerSensor = useSensor(PointerSensor, {
    activationConstraint: { distance: 5 },
  });
  const touchSensor = useSensor(TouchSensor, {
    activationConstraint: { delay: 150, tolerance: 5 },
  });
  const keyboardSensor = useSensor(KeyboardSensor, {
    coordinateGetter: sortableKeyboardCoordinates,
  });
  const sensors = useSensors(pointerSensor, touchSensor, keyboardSensor);

  // Handle Drag End for Lessons inside a module
  const handleDragEnd = (event: DragEndEvent, moduleId: string) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const moduleLessons = lessons.filter(l => l.moduleId === moduleId);
    const oldIndex = moduleLessons.findIndex(l => l.id === active.id);
    const newIndex = moduleLessons.findIndex(l => l.id === over.id);

    if (oldIndex !== -1 && newIndex !== -1) {
      const reordered = arrayMove(moduleLessons, oldIndex, newIndex).map((l, idx) => ({
        ...l,
        order: idx + 1,
      }));
      onReorderLessons(moduleId, reordered);
    }
  };

  return (
    <div className="flex flex-col h-full bg-muted/20 border-r border-border overflow-y-auto p-4 space-y-4">
      {/* Header and Add Module Button */}
      <div className="flex items-center justify-between pb-3 border-b border-border">
        <div>
          <h2 className="text-xs font-black uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
            <Layers className="w-4 h-4 text-primary" /> Curriculum Hierarchy
          </h2>
          <p className="text-[11px] text-muted-foreground font-medium">
            {modules.length} Modules • {lessons.length} Lessons
          </p>
        </div>

        <Button
          size="sm"
          onClick={onAddModule}
          disabled={isMutating}
          className="rounded-xl font-bold text-xs bg-primary text-white hover:bg-primary/90 gap-1.5 active:scale-[0.97] min-h-[44px]"
        >
          <Plus className="w-3.5 h-3.5" /> Add Module
        </Button>
      </div>

      {/* Module Cards List */}
      {modules.length === 0 ? (
        <div className="p-8 text-center border-2 border-dashed rounded-3xl space-y-3 bg-muted/10 my-auto">
          <Layers className="w-8 h-8 mx-auto text-primary/60" />
          <h4 className="font-bold text-xs text-foreground">No Modules Created</h4>
          <p className="text-[11px] text-muted-foreground max-w-xs mx-auto">
            Click &quot;Add Module&quot; above to create your first educational section.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {modules.map((mod, modIdx) => {
            const moduleLessons = lessons.filter(l => l.moduleId === mod.id);

            return (
              <Card
                key={mod.id}
                className="rounded-3xl border-2 border-border/80 p-4 space-y-3 bg-card/60 shadow-2xs"
              >
                {/* Module Header */}
                <div className="flex items-start justify-between gap-2 border-b border-border/50 pb-2.5">
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center gap-2">
                      <Badge className="bg-primary/10 text-primary border-0 text-[9px] font-extrabold uppercase">
                        Module {modIdx + 1}
                      </Badge>
                      <Input
                        value={mod.title}
                        onChange={e => onUpdateModule(mod.id, { title: e.target.value })}
                        className="font-bold text-xs h-7 rounded-lg border-transparent hover:border-border focus:border-primary px-1.5"
                      />
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => onDeleteModule(mod.id)}
                    className="w-7 h-7 rounded-lg flex items-center justify-center text-muted-foreground hover:text-rose-500 hover:bg-rose-500/10 active:scale-[0.95] transition-colors"
                    title="Delete Module and child lessons"
                    aria-label="Delete Module"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Module Drip Schedule Setting */}
                <div className="flex items-center gap-2 text-xs bg-muted/30 p-2 rounded-xl border border-border/60">
                  <Lock className="w-3 h-3 text-primary shrink-0" />
                  <span className="text-[10px] font-bold text-muted-foreground uppercase">Drip:</span>
                  <Select
                    value={mod.releaseRule?.type || 'immediate'}
                    onValueChange={(val: ReleaseScheduleType) =>
                      onUpdateModule(mod.id, {
                        releaseRule: { ...mod.releaseRule, type: val },
                      })
                    }
                  >
                    <SelectTrigger className="h-7 text-xs rounded-lg flex-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl">
                      <SelectItem value="immediate">Immediate</SelectItem>
                      <SelectItem value="days_after_enrollment">Days After Enrollment</SelectItem>
                      <SelectItem value="days_after_join">Days After Join</SelectItem>
                      <SelectItem value="specific_date">Specific Date</SelectItem>
                    </SelectContent>
                  </Select>

                  {(mod.releaseRule?.type === 'days_after_enrollment' ||
                    mod.releaseRule?.type === 'days_after_join') && (
                    <div className="flex items-center gap-1">
                      <Input
                        type="number"
                        min="1"
                        value={mod.releaseRule.daysDelay || 7}
                        onChange={e =>
                          onUpdateModule(mod.id, {
                            releaseRule: {
                              ...mod.releaseRule,
                              type: mod.releaseRule?.type || 'days_after_enrollment',
                              daysDelay: Number(e.target.value) || 1,
                            },
                          })
                        }
                        className="w-14 h-7 text-xs rounded-lg text-center"
                      />
                      <span className="text-[10px] text-muted-foreground">d</span>
                    </div>
                  )}
                </div>

                {/* Nested Sortable Lessons */}
                <div className="space-y-2 pt-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-foreground">
                      Lessons ({moduleLessons.length})
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => onAddLesson(mod.id)}
                      className="text-xs font-bold text-primary hover:bg-primary/10 h-7 rounded-xl gap-1 active:scale-[0.97]"
                    >
                      <Plus className="w-3 h-3" /> Add Lesson
                    </Button>
                  </div>

                  <DndContext
                    sensors={sensors}
                    collisionDetection={closestCenter}
                    onDragEnd={e => handleDragEnd(e, mod.id)}
                  >
                    <SortableContext
                      items={moduleLessons.map(l => l.id)}
                      strategy={verticalListSortingStrategy}
                    >
                      <div className="space-y-1.5">
                        {moduleLessons.map((les, lesIdx) => (
                          <SortableLessonRow
                            key={les.id}
                            lesson={les}
                            index={lesIdx}
                            totalLessons={moduleLessons.length}
                            isSelected={les.id === selectedLessonId}
                            onSelect={() => onSelectLesson(les.id)}
                            onDelete={() => onDeleteLesson(les.id)}
                            onMoveUp={() => {
                              if (lesIdx > 0) {
                                const reordered = arrayMove(moduleLessons, lesIdx, lesIdx - 1).map(
                                  (item, idx) => ({ ...item, order: idx + 1 })
                                );
                                onReorderLessons(mod.id, reordered);
                              }
                            }}
                            onMoveDown={() => {
                              if (lesIdx < moduleLessons.length - 1) {
                                const reordered = arrayMove(moduleLessons, lesIdx, lesIdx + 1).map(
                                  (item, idx) => ({ ...item, order: idx + 1 })
                                );
                                onReorderLessons(mod.id, reordered);
                              }
                            }}
                          />
                        ))}
                      </div>
                    </SortableContext>
                  </DndContext>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

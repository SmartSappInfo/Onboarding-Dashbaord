'use client';

/**
 * ARCHITECTURAL GUIDANCE FOR MAINTAINERS (Rule 10 Maintainer Guidance):
 *
 * 1. Purpose:
 *    Drag-and-Drop Multi-Party Recipient Routing Editor (Phase 2, P2.5 UI).
 * 2. Interaction Design & Compliance:
 *    - Implements accessible `@dnd-kit` sortable recipient lists for sequential/parallel routing.
 *    - Touch-Target Accessibility: All controls strictly enforce `min-h-[44px]` touch targets.
 *    - iOS Zoom Lock: All text inputs enforce `text-base sm:text-sm` (16px minimum on mobile).
 *    - Emil Kowalski Micro-Interactions: Buttons feature `active:scale-[0.97]` tactile transitions.
 *    - High-Contrast Badges: Color-coded role indicators (Signer = Indigo, Approver = Amber,
 *      Countersigner = Emerald, Viewer = Slate).
 * 3. Strict Typing Standard (Rule 4 Zero-Tolerance Typing):
 *    Strictly zero `any` or `any[]`.
 */

import * as React from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, Plus, Trash2, ArrowUp, ArrowDown, Users, Sparkles, Shield } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import type { RecipientRole, EnvelopeRoutingMode } from '@/lib/types/document-signing';

export interface RecipientDraft {
  id: string;
  name: string;
  email: string;
  phone?: string;
  role: RecipientRole;
  routingOrder: number;
}

export interface RecipientRoutingEditorProps {
  recipients: RecipientDraft[];
  routingMode: EnvelopeRoutingMode;
  onRecipientsChange: (recipients: RecipientDraft[]) => void;
  onRoutingModeChange: (mode: EnvelopeRoutingMode) => void;
  disabled?: boolean;
}

const ROLE_BADGES: Record<RecipientRole, { label: string; className: string }> = {
  signer: {
    label: 'Signer',
    className: 'bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 border-indigo-500/20',
  },
  approver: {
    label: 'Approver',
    className: 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20',
  },
  countersigner: {
    label: 'Countersigner',
    className: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20',
  },
  viewer: {
    label: 'Viewer / CC',
    className: 'bg-slate-500/10 text-slate-700 dark:text-slate-400 border-slate-500/20',
  },
};

interface SortableRecipientCardProps {
  recipient: RecipientDraft;
  index: number;
  total: number;
  routingMode: EnvelopeRoutingMode;
  onUpdate: (id: string, updates: Partial<RecipientDraft>) => void;
  onDelete: (id: string) => void;
  onMove: (fromIndex: number, toIndex: number) => void;
  disabled?: boolean;
}

function SortableRecipientCard({
  recipient,
  index,
  total,
  routingMode,
  onUpdate,
  onDelete,
  onMove,
  disabled,
}: SortableRecipientCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: recipient.id,
    disabled,
  });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const roleInfo = ROLE_BADGES[recipient.role] || ROLE_BADGES.signer;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'group relative flex flex-col md:flex-row md:items-center gap-4 p-4 rounded-2xl border bg-card transition-all duration-200',
        isDragging && 'opacity-60 scale-[1.01] shadow-xl border-primary z-50',
        !isDragging && 'hover:border-primary/40 hover:shadow-md'
      )}
    >
      {/* Drag Handle & Order Badge */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          aria-label={`Reorder recipient ${recipient.name || index + 1}`}
          className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted active:scale-[0.97] transition-all cursor-grab active:cursor-grabbing touch-none"
          {...attributes}
          {...listeners}
          disabled={disabled}
        >
          <GripVertical className="h-5 w-5" />
        </button>

        <div className="flex flex-col items-start gap-1">
          <Badge
            variant="outline"
            className={cn(
              'font-semibold text-xs px-2.5 py-0.5 rounded-lg border',
              routingMode === 'sequential'
                ? 'bg-primary/10 text-primary border-primary/20'
                : 'bg-muted text-muted-foreground'
            )}
          >
            {routingMode === 'sequential' ? `Step ${recipient.routingOrder}` : 'Cohort'}
          </Badge>
          <Badge variant="outline" className={cn('text-[10px] px-2 py-0 border', roleInfo.className)}>
            {roleInfo.label}
          </Badge>
        </div>
      </div>

      {/* Recipient Details Inputs */}
      <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        <div className="space-y-1">
          <Label className="text-xs font-semibold text-muted-foreground">Full Name</Label>
          <Input
            value={recipient.name}
            onChange={(e) => onUpdate(recipient.id, { name: e.target.value })}
            placeholder="Signer Full Name"
            disabled={disabled}
            className="min-h-[44px] text-base sm:text-sm rounded-xl"
          />
        </div>

        <div className="space-y-1">
          <Label className="text-xs font-semibold text-muted-foreground">Email Address</Label>
          <Input
            type="email"
            value={recipient.email}
            onChange={(e) => onUpdate(recipient.id, { email: e.target.value })}
            placeholder="signer@example.com"
            disabled={disabled}
            className="min-h-[44px] text-base sm:text-sm rounded-xl"
          />
        </div>

        <div className="space-y-1">
          <Label className="text-xs font-semibold text-muted-foreground">Signing Role</Label>
          <Select
            value={recipient.role}
            onValueChange={(val) => onUpdate(recipient.id, { role: val as RecipientRole })}
            disabled={disabled}
          >
            <SelectTrigger className="min-h-[44px] text-base sm:text-sm rounded-xl">
              <SelectValue placeholder="Role" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="signer">Signer (Primary Signatory)</SelectItem>
              <SelectItem value="approver">Approver (Internal Reviewer)</SelectItem>
              <SelectItem value="countersigner">Countersigner (Executive)</SelectItem>
              <SelectItem value="viewer">Viewer (Read-only CC)</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Reorder and Delete Actions */}
      <div className="flex items-center justify-end gap-1 shrink-0 pt-2 md:pt-0">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label="Move Up"
          disabled={disabled || index === 0}
          onClick={() => onMove(index, index - 1)}
          className="min-h-[44px] min-w-[44px] rounded-xl hover:bg-muted active:scale-[0.97]"
        >
          <ArrowUp className="h-4 w-4" />
        </Button>

        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label="Move Down"
          disabled={disabled || index === total - 1}
          onClick={() => onMove(index, index + 1)}
          className="min-h-[44px] min-w-[44px] rounded-xl hover:bg-muted active:scale-[0.97]"
        >
          <ArrowDown className="h-4 w-4" />
        </Button>

        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label="Delete Signatory"
          disabled={disabled || total <= 1}
          onClick={() => onDelete(recipient.id)}
          className="min-h-[44px] min-w-[44px] rounded-xl text-destructive hover:bg-destructive/10 active:scale-[0.97]"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

export default function RecipientRoutingEditor({
  recipients,
  routingMode,
  onRecipientsChange,
  onRoutingModeChange,
  disabled,
}: RecipientRoutingEditorProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIndex = recipients.findIndex((item) => item.id === active.id);
      const newIndex = recipients.findIndex((item) => item.id === over.id);

      const reordered = arrayMove(recipients, oldIndex, newIndex).map((r, idx) => ({
        ...r,
        routingOrder: routingMode === 'sequential' ? idx + 1 : 1,
      }));

      onRecipientsChange(reordered);
    }
  };

  const handleUpdate = (id: string, updates: Partial<RecipientDraft>) => {
    const updated = recipients.map((r) => (r.id === id ? { ...r, ...updates } : r));
    onRecipientsChange(updated);
  };

  const handleDelete = (id: string) => {
    if (recipients.length <= 1) return;
    const filtered = recipients.filter((r) => r.id !== id).map((r, idx) => ({
      ...r,
      routingOrder: routingMode === 'sequential' ? idx + 1 : 1,
    }));
    onRecipientsChange(filtered);
  };

  const handleMove = (fromIndex: number, toIndex: number) => {
    if (toIndex < 0 || toIndex >= recipients.length) return;
    const reordered = arrayMove(recipients, fromIndex, toIndex).map((r, idx) => ({
      ...r,
      routingOrder: routingMode === 'sequential' ? idx + 1 : 1,
    }));
    onRecipientsChange(reordered);
  };

  const handleAddRecipient = () => {
    const nextOrder = routingMode === 'sequential' ? recipients.length + 1 : 1;
    const newRecipient: RecipientDraft = {
      id: `draft_rec_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      name: '',
      email: '',
      role: 'signer',
      routingOrder: nextOrder,
    };
    onRecipientsChange([...recipients, newRecipient]);
  };

  const handleRoutingModeToggle = (mode: EnvelopeRoutingMode) => {
    onRoutingModeChange(mode);
    const updated = recipients.map((r, idx) => ({
      ...r,
      routingOrder: mode === 'sequential' ? idx + 1 : 1,
    }));
    onRecipientsChange(updated);
  };

  return (
    <div className="space-y-6">
      {/* Routing Mode Controller */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-2xl bg-muted/40 border">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-primary/10 rounded-xl text-primary">
            <Users className="h-5 w-5" />
          </div>
          <div>
            <h4 className="text-sm font-semibold tracking-tight">Routing Strategy</h4>
            <p className="text-xs text-muted-foreground">
              Define whether signers execute in linear order or concurrently.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 p-1 bg-background rounded-xl border">
          <button
            type="button"
            onClick={() => handleRoutingModeToggle('sequential')}
            disabled={disabled}
            className={cn(
              'px-3 py-1.5 rounded-lg text-xs font-semibold transition-all min-h-[44px] flex items-center gap-1.5 active:scale-[0.97]',
              routingMode === 'sequential'
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            <Sparkles className="h-3.5 w-3.5" />
            Sequential Chain
          </button>

          <button
            type="button"
            onClick={() => handleRoutingModeToggle('parallel')}
            disabled={disabled}
            className={cn(
              'px-3 py-1.5 rounded-lg text-xs font-semibold transition-all min-h-[44px] flex items-center gap-1.5 active:scale-[0.97]',
              routingMode === 'parallel'
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            <Shield className="h-3.5 w-3.5" />
            Parallel Cohort
          </button>
        </div>
      </div>

      {/* Recipient Cards Sortable Area */}
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={recipients.map((r) => r.id)} strategy={verticalListSortingStrategy}>
          <div className="space-y-3">
            {recipients.map((recipient, index) => (
              <SortableRecipientCard
                key={recipient.id}
                recipient={recipient}
                index={index}
                total={recipients.length}
                routingMode={routingMode}
                onUpdate={handleUpdate}
                onDelete={handleDelete}
                onMove={handleMove}
                disabled={disabled}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      {/* Add Signatory Button */}
      <Button
        type="button"
        variant="outline"
        onClick={handleAddRecipient}
        disabled={disabled}
        className="w-full min-h-[48px] rounded-2xl border-dashed border-2 hover:border-primary hover:bg-primary/5 active:scale-[0.97] flex items-center justify-center gap-2 font-semibold text-sm transition-all"
      >
        <Plus className="h-4 w-4 text-primary" />
        Add Signatory or Approver
      </Button>
    </div>
  );
}

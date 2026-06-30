'use client';

import * as React from 'react';
import type { Form, FormFieldInstance, AppField } from '@/lib/types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  useDroppable,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  GripVertical,
  ChevronUp,
  ChevronDown,
  Trash2,
  Lock,
  EyeOff,
  CaseSensitive,
  FileText,
  Mail,
  Phone,
  Hash,
  Calendar,
  ListFilter,
  ToggleLeft,
  MapPin,
  Link as LinkIcon,
  Layout,
} from 'lucide-react';
import type { ViewportSize } from './ViewportToggle';

const FIELD_TYPE_ICONS: Record<string, React.ElementType> = {
  short_text: CaseSensitive,
  long_text: FileText,
  email: Mail,
  phone: Phone,
  number: Hash,
  currency: Hash,
  date: Calendar,
  datetime: Calendar,
  select: ListFilter,
  multi_select: ListFilter,
  radio: ToggleLeft,
  checkbox: ToggleLeft,
  yes_no: ToggleLeft,
  address: MapPin,
  url: LinkIcon,
  hidden: EyeOff,
};

interface SortableItemProps {
  instance: FormFieldInstance;
  idx: number;
  appField: AppField | undefined;
  isSelected: boolean;
  isFirst: boolean;
  isLast: boolean;
  themePreset?: string;
  inputStyle?: string;
  onSelect: () => void;
  onUpdateWidth: (w: 'full' | 'half') => void;
  onUpdateRequired: (r: boolean) => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onRemove: () => void;
}

// Extracted from render to prevent recreation focus/state loss
function SortableFieldItem({
  instance,
  idx,
  appField,
  isSelected,
  isFirst,
  isLast,
  themePreset,
  inputStyle,
  onSelect,
  onUpdateWidth,
  onUpdateRequired,
  onMoveUp,
  onMoveDown,
  onRemove,
}: SortableItemProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: instance.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 30 : 10,
    position: isDragging ? ('relative' as any) : ('static' as any),
  };

  const Icon = FIELD_TYPE_ICONS[appField?.type || 'short_text'] || CaseSensitive;

  // Handle click on card for selection, but stop propagation for inner control buttons
  const handleCardClick = (e: React.MouseEvent) => {
    // Only select if not clicking interactive input elements or buttons
    const target = e.target as HTMLElement;
    if (target.closest('button') || target.closest('select') || target.closest('[role="switch"]')) {
      return;
    }
    onSelect();
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      onClick={handleCardClick}
      className={cn(
        'group flex flex-col p-4 rounded-xl border transition-all text-left bg-background relative cursor-pointer select-none',
        isSelected
          ? 'border-primary ring-2 ring-primary/20 bg-primary/[0.02] shadow-md shadow-primary/5'
          : 'border-border/50 hover:border-primary/20 hover:bg-muted/10 hover:shadow-sm',
        isDragging && 'opacity-40 border-primary bg-muted/20'
      )}
    >
      <div className="flex items-center gap-3">
        {/* Grip Handle */}
        <div
          {...attributes}
          {...listeners}
          aria-label="Drag to reorder field"
          className="cursor-grab p-2 hover:bg-muted/60 rounded-xl text-muted-foreground/30 hover:text-muted-foreground shrink-0 touch-none flex items-center justify-center h-11 w-11"
        >
          <GripVertical className="h-4 w-4" />
        </div>

        {/* Icon */}
        <div className="p-1.5 bg-primary/10 rounded-lg shrink-0">
          <Icon className="h-3.5 w-3.5 text-primary" />
        </div>

        {/* Labels & Tags */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 mb-0.5">
            <span className="text-sm font-bold truncate">
              {instance.labelOverride || appField?.label || 'Loading Field...'}
            </span>
            {appField?.isNative && (
              <Badge variant="secondary" className="h-3.5 text-[7px] uppercase px-1 font-bold bg-primary/15 text-primary border-none">
                <Lock className="h-2 w-2 mr-0.5" /> Native
              </Badge>
            )}
            {instance.hidden && (
              <Badge variant="outline" className="h-3.5 text-[7px] uppercase px-1 font-bold">
                <EyeOff className="h-2 w-2 mr-0.5" /> Hidden
              </Badge>
            )}
          </div>
          <code className="text-[9px] font-mono text-muted-foreground/80">
            {'{{' + (appField?.variableName || '?') + '}}'}
          </code>
        </div>

        {/* Interactive Controls */}
        <div className="flex items-center gap-1.5 shrink-0">
          <Select
            value={instance.width || 'full'}
            onValueChange={onUpdateWidth}
          >
            <SelectTrigger className="h-9 w-20 rounded-xl text-[10px] border-none bg-muted/40 font-semibold focus:ring-0">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="rounded-xl">
              <SelectItem value="full">Full</SelectItem>
              <SelectItem value="half">Half</SelectItem>
            </SelectContent>
          </Select>

          <div className="flex items-center gap-1 bg-muted/40 rounded-xl p-1 h-9">
            <Switch
              checked={instance.required}
              onCheckedChange={onUpdateRequired}
              className="scale-75"
            />
            <span className="text-[8px] font-bold text-muted-foreground pr-1">Req</span>
          </div>

          <Button
            variant="ghost"
            size="icon"
            className="h-11 w-11 rounded-xl text-muted-foreground/50 hover:text-foreground hover:bg-muted/40 transition-colors active:scale-95"
            onClick={onMoveUp}
            disabled={isFirst}
            aria-label="Move field up"
          >
            <ChevronUp className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-11 w-11 rounded-xl text-muted-foreground/50 hover:text-foreground hover:bg-muted/40 transition-colors active:scale-95"
            onClick={onMoveDown}
            disabled={isLast}
            aria-label="Move field down"
          >
            <ChevronDown className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-11 w-11 rounded-xl text-destructive hover:bg-destructive/10 opacity-0 group-hover:opacity-100 transition-opacity active:scale-95"
            onClick={onRemove}
            aria-label="Remove field"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Field Overrides Visual Sandbox Preview */}
      <div className="mt-3 pl-12 pr-4">
        <div className="text-[10px] text-muted-foreground/60 mb-1">Preview Input Styling:</div>
        {appField?.type === 'long_text' ? (
          <div className={cn(
            'h-12 w-full rounded-lg border text-[10px] px-3 py-1 text-muted-foreground bg-background/50 flex items-start select-none',
            inputStyle === 'filled' && 'bg-muted border-none',
            inputStyle === 'flushed' && 'border-x-0 border-t-0 rounded-none px-0'
          )}>
            {instance.placeholderOverride || appField.placeholder || 'Enter response...'}
          </div>
        ) : (
          <div className={cn(
            'h-8 w-full rounded-lg border text-[10px] px-3 text-muted-foreground bg-background/50 flex items-center select-none',
            inputStyle === 'filled' && 'bg-muted border-none',
            inputStyle === 'flushed' && 'border-x-0 border-t-0 rounded-none px-0'
          )}>
            {instance.placeholderOverride || appField?.placeholder || 'Enter value...'}
          </div>
        )}
        {instance.helpTextOverride && (
          <p className="text-[9px] text-muted-foreground/60 mt-1 italic">{instance.helpTextOverride}</p>
        )}
      </div>
    </div>
  );
}

function EmptyCanvasZone({ onAddStandardField }: { onAddStandardField: (type: string) => void }) {
  const { setNodeRef, isOver } = useDroppable({
    id: 'canvas-empty-dropzone',
  });

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex-1 flex flex-col items-center justify-center py-20 border-2 border-dashed rounded-[2.5rem] border-border/40 transition-all duration-300 p-8 text-center select-none min-h-[300px]",
        isOver ? "border-primary bg-primary/[0.03] scale-[0.99] shadow-inner" : "border-border/50 bg-background/40 shadow-sm"
      )}
    >
      <div className="p-4 bg-primary/10 rounded-3xl mb-4 transition-transform duration-300 hover:scale-110">
        <Layout className="h-8 w-8 text-primary" />
      </div>
      <h3 className="text-sm font-bold text-foreground">Your Canvas is Waiting</h3>
      <p className="text-xs text-muted-foreground mt-1 max-w-[260px] leading-relaxed">
        Drag and drop fields from the sidebar, or use the quick buttons below to seed your form.
      </p>
      <div className="flex gap-2 mt-6">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="rounded-xl text-[10px] font-semibold gap-1.5 active:scale-[0.97] transition-all"
          onClick={() => onAddStandardField('email')}
        >
          <Mail className="h-3.5 w-3.5" /> + Email
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="rounded-xl text-[10px] font-semibold gap-1.5 active:scale-[0.97] transition-all"
          onClick={() => onAddStandardField('phone')}
        >
          <Phone className="h-3.5 w-3.5" /> + Phone
        </Button>
      </div>
    </div>
  );
}

interface BuilderCanvasProps {
  form: Partial<Form>;
  fields: FormFieldInstance[];
  selectedFieldId: string | null;
  viewportSize: ViewportSize;
  getAppField: (appFieldId: string) => AppField | undefined;
  onSelectField: (instance: FormFieldInstance) => void;
  onUpdateFieldInstance: (instanceId: string, updates: Partial<FormFieldInstance>) => void;
  onMoveField: (instanceId: string, direction: 'up' | 'down') => void;
  onRemoveField: (instanceId: string) => void;
  onReorderFields: (orderedFields: FormFieldInstance[]) => void;
  onAddStandardField: (type: string) => void;
}

export default function BuilderCanvas({
  form,
  fields,
  selectedFieldId,
  viewportSize,
  getAppField,
  onSelectField,
  onUpdateFieldInstance,
  onMoveField,
  onRemoveField,
  onReorderFields,
  onAddStandardField,
}: BuilderCanvasProps) {
  const isMobile = viewportSize === 'mobile';
  const isTablet = viewportSize === 'tablet';

  const previewFrameWidth = isMobile
    ? 'max-w-[390px] rounded-[3rem] border-[12px] border-neutral-900 shadow-2xl p-6 bg-card min-h-[640px]'
    : isTablet
    ? 'max-w-[768px] border rounded-2xl p-8 bg-card shadow-md'
    : 'max-w-4xl w-full border rounded-2xl p-8 bg-card shadow-md';

  const themePreset = form.theme?.preset || 'professional';
  const inputStyle = form.theme?.inputStyle || 'outline';

  return (
    <section className="flex-1 bg-muted/20 overflow-y-auto p-8 flex justify-center items-start min-h-0 select-none">
      <div className={cn('w-full transition-all duration-300 relative flex flex-col', previewFrameWidth)}>
        {/* Smartphone Camera Notch Mockup */}
        {isMobile && (
          <div className="absolute top-2 left-1/2 -translate-x-1/2 w-32 h-4 bg-neutral-900 rounded-full z-20 flex items-center justify-center">
            <div className="w-2.5 h-2.5 bg-neutral-800 rounded-full mr-2" />
            <div className="w-8 h-1.5 bg-neutral-800 rounded-full" />
          </div>
        )}

        {/* Visual Header of Simulated Form */}
        <div className="text-center mb-8 pt-4">
          <h2 className="text-lg font-bold text-foreground">
            {form.title || 'Untitled Application'}
          </h2>
          {form.description && (
            <p className="text-xs text-muted-foreground mt-1.5 leading-normal max-w-md mx-auto">
              {form.description}
            </p>
          )}
        </div>

        {/* Fields list */}
        {fields.length === 0 ? (
          <EmptyCanvasZone onAddStandardField={onAddStandardField} />
        ) : (
          <SortableContext items={fields.map(f => f.id)} strategy={verticalListSortingStrategy}>
            <div className="space-y-4 flex-1">
              {fields
                .sort((a, b) => a.order - b.order)
                .map((instance, idx) => {
                  const appField = getAppField(instance.appFieldId);
                  return (
                    <SortableFieldItem
                      key={instance.id}
                      instance={instance}
                      idx={idx}
                      appField={appField}
                      isSelected={selectedFieldId === instance.id}
                      isFirst={idx === 0}
                      isLast={idx === fields.length - 1}
                      themePreset={themePreset}
                      inputStyle={inputStyle}
                      onSelect={() => onSelectField(instance)}
                      onUpdateWidth={w => onUpdateFieldInstance(instance.id, { width: w })}
                      onUpdateRequired={r => onUpdateFieldInstance(instance.id, { required: r })}
                      onMoveUp={() => onMoveField(instance.id, 'up')}
                      onMoveDown={() => onMoveField(instance.id, 'down')}
                      onRemove={() => onRemoveField(instance.id)}
                    />
                  );
                })}
            </div>
          </SortableContext>
        )}

        {/* Simulated CTA Submit Button */}
        <div className="mt-8 pt-4 border-t border-border/30">
          <Button
            style={{
              backgroundColor: form.theme?.accentColor || '#3b82f6',
              color: '#ffffff',
            }}
            className={cn(
              'h-10 rounded-xl text-xs font-bold font-mono tracking-wide shadow-md active:scale-[0.98] transition-all select-none',
              form.theme?.ctaWidth === 'full' ? 'w-full' : 'w-auto px-8'
            )}
          >
            {form.theme?.ctaLabel || 'Submit Application'}
          </Button>
        </div>
      </div>
    </section>
  );
}
